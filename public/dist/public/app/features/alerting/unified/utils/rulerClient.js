import { __awaiter } from "tslib";
import { deleteRulerRulesGroup, fetchRulerRulesGroup, fetchRulerRules, setRulerRuleGroup } from '../api/ruler';
import * as ruleId from '../utils/rule-id';
import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
import { formValuesToRulerGrafanaRuleDTO, formValuesToRulerRuleDTO } from './rule-form';
import { isCloudRuleIdentifier, isGrafanaRuleIdentifier, isGrafanaRulerRule, isPrometheusRuleIdentifier, } from './rules';
export function getRulerClient(rulerConfig) {
    const findEditableRule = (ruleIdentifier) => __awaiter(this, void 0, void 0, function* () {
        if (isGrafanaRuleIdentifier(ruleIdentifier)) {
            const namespaces = yield fetchRulerRules(rulerConfig);
            // find namespace and group that contains the uid for the rule
            for (const [namespace, groups] of Object.entries(namespaces)) {
                for (const group of groups) {
                    const rule = group.rules.find((rule) => { var _a; return isGrafanaRulerRule(rule) && ((_a = rule.grafana_alert) === null || _a === void 0 ? void 0 : _a.uid) === ruleIdentifier.uid; });
                    if (rule) {
                        return {
                            group,
                            ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
                            namespace: namespace,
                            rule,
                        };
                    }
                }
            }
        }
        if (isCloudRuleIdentifier(ruleIdentifier)) {
            const { ruleSourceName, namespace, groupName } = ruleIdentifier;
            const group = yield fetchRulerRulesGroup(rulerConfig, namespace, groupName);
            if (!group) {
                return null;
            }
            const rule = group.rules.find((rule) => {
                const identifier = ruleId.fromRulerRule(ruleSourceName, namespace, group.name, rule);
                return ruleId.equal(identifier, ruleIdentifier);
            });
            if (!rule) {
                return null;
            }
            return {
                group,
                ruleSourceName,
                namespace,
                rule,
            };
        }
        if (isPrometheusRuleIdentifier(ruleIdentifier)) {
            throw new Error('Native prometheus rules can not be edited in grafana.');
        }
        return null;
    });
    const deleteRule = (ruleWithLocation) => __awaiter(this, void 0, void 0, function* () {
        const { namespace, group, rule } = ruleWithLocation;
        // it was the last rule, delete the entire group
        if (group.rules.length === 1) {
            yield deleteRulerRulesGroup(rulerConfig, namespace, group.name);
            return;
        }
        // post the group with rule removed
        yield setRulerRuleGroup(rulerConfig, namespace, Object.assign(Object.assign({}, group), { rules: group.rules.filter((r) => r !== rule) }));
    });
    const saveLotexRule = (values, evaluateEvery, existing) => __awaiter(this, void 0, void 0, function* () {
        const { dataSourceName, group, namespace } = values;
        const formRule = formValuesToRulerRuleDTO(values);
        if (dataSourceName && group && namespace) {
            // if we're updating a rule...
            if (existing) {
                // refetch it so we always have the latest greatest
                const freshExisting = yield findEditableRule(ruleId.fromRuleWithLocation(existing));
                if (!freshExisting) {
                    throw new Error('Rule not found.');
                }
                // if namespace or group was changed, delete the old rule
                if (freshExisting.namespace !== namespace || freshExisting.group.name !== group) {
                    yield deleteRule(freshExisting);
                }
                else {
                    // if same namespace or group, update the group replacing the old rule with new
                    const payload = Object.assign(Object.assign({}, freshExisting.group), { rules: freshExisting.group.rules.map((existingRule) => existingRule === freshExisting.rule ? formRule : existingRule), evaluateEvery: evaluateEvery });
                    yield setRulerRuleGroup(rulerConfig, namespace, payload);
                    return ruleId.fromRulerRule(dataSourceName, namespace, group, formRule);
                }
            }
            // if creating new rule or existing rule was in a different namespace/group, create new rule in target group
            const targetGroup = yield fetchRulerRulesGroup(rulerConfig, namespace, group);
            const payload = targetGroup
                ? Object.assign(Object.assign({}, targetGroup), { rules: [...targetGroup.rules, formRule] }) : {
                name: group,
                rules: [formRule],
            };
            yield setRulerRuleGroup(rulerConfig, namespace, payload);
            return ruleId.fromRulerRule(dataSourceName, namespace, group, formRule);
        }
        else {
            throw new Error('Data source and location must be specified');
        }
    });
    const saveGrafanaRule = (values, evaluateEvery, existingRule) => __awaiter(this, void 0, void 0, function* () {
        const { folder, group } = values;
        if (!folder) {
            throw new Error('Folder must be specified');
        }
        const newRule = formValuesToRulerGrafanaRuleDTO(values);
        const namespace = folder.title;
        const groupSpec = { name: group, interval: evaluateEvery };
        if (!existingRule) {
            return addRuleToNamespaceAndGroup(namespace, groupSpec, newRule);
        }
        // we'll fetch the existing group again, someone might have updated it while we were editing a rule
        const freshExisting = yield findEditableRule(ruleId.fromRuleWithLocation(existingRule));
        if (!freshExisting) {
            throw new Error('Rule not found.');
        }
        const sameNamespace = freshExisting.namespace === namespace;
        const sameGroup = freshExisting.group.name === values.group;
        const sameLocation = sameNamespace && sameGroup;
        if (sameLocation) {
            // we're update a rule in the same namespace and group
            return updateGrafanaRule(freshExisting, newRule, evaluateEvery);
        }
        else {
            // we're moving a rule to either a different group or namespace
            return moveGrafanaRule(namespace, groupSpec, freshExisting, newRule);
        }
    });
    const addRuleToNamespaceAndGroup = (namespace, group, newRule) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const existingGroup = yield fetchRulerRulesGroup(rulerConfig, namespace, group.name);
        if (!existingGroup) {
            throw new Error(`No group found with name "${group.name}"`);
        }
        const payload = {
            name: group.name,
            interval: group.interval,
            rules: ((_a = existingGroup.rules) !== null && _a !== void 0 ? _a : []).concat(newRule),
        };
        yield setRulerRuleGroup(rulerConfig, namespace, payload);
        return { uid: (_b = newRule.grafana_alert.uid) !== null && _b !== void 0 ? _b : '', ruleSourceName: GRAFANA_RULES_SOURCE_NAME };
    });
    // move the rule to another namespace / groupname
    const moveGrafanaRule = (namespace, group, existingRule, newRule) => __awaiter(this, void 0, void 0, function* () {
        // make sure our updated alert has the same UID as before
        // that way the rule is automatically moved to the new namespace / group name
        copyGrafanaUID(existingRule, newRule);
        // add the new rule to the requested namespace and group
        const identifier = yield addRuleToNamespaceAndGroup(namespace, group, newRule);
        return identifier;
    });
    const updateGrafanaRule = (existingRule, newRule, interval) => __awaiter(this, void 0, void 0, function* () {
        // make sure our updated alert has the same UID as before
        copyGrafanaUID(existingRule, newRule);
        // create the new array of rules we want to send to the group. Keep the order of alerts in the group.
        const newRules = existingRule.group.rules.map((rule) => {
            if (!isGrafanaRulerRule(rule)) {
                return rule;
            }
            if (rule.grafana_alert.uid === existingRule.rule.grafana_alert.uid) {
                return newRule;
            }
            return rule;
        });
        yield setRulerRuleGroup(rulerConfig, existingRule.namespace, {
            name: existingRule.group.name,
            interval: interval,
            rules: newRules,
        });
        return { uid: existingRule.rule.grafana_alert.uid, ruleSourceName: GRAFANA_RULES_SOURCE_NAME };
    });
    // Would be nice to somehow align checking of ruler type between different methods
    // Maybe each datasource should have its own ruler client implementation
    return {
        findEditableRule,
        deleteRule,
        saveLotexRule,
        saveGrafanaRule,
    };
}
//copy the Grafana rule UID from the old rule to the new rule
function copyGrafanaUID(oldRule, newRule) {
    // type guard to make sure we're working with a Grafana managed rule
    if (!isGrafanaRulerRule(oldRule.rule)) {
        throw new Error('The rule is not a Grafana managed rule');
    }
    const uid = oldRule.rule.grafana_alert.uid;
    newRule.grafana_alert.uid = uid;
}
//# sourceMappingURL=rulerClient.js.map