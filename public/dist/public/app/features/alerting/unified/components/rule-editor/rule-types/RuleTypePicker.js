import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import React, { useEffect } from 'react';
import { Stack } from '@grafana/experimental';
import { useStyles2 } from '@grafana/ui';
import { dispatch } from 'app/store/store';
import { useRulesSourcesWithRuler } from '../../../hooks/useRuleSourcesWithRuler';
import { fetchAllPromBuildInfoAction } from '../../../state/actions';
import { RuleFormType } from '../../../types/rule-form';
import { GrafanaManagedRuleType } from './GrafanaManagedAlert';
import { MimirFlavoredType } from './MimirOrLokiAlert';
import { TemplatedAlertRuleType } from './TemplatedAlert';
const RuleTypePicker = ({ selected, onChange, enabledTypes }) => {
    const rulesSourcesWithRuler = useRulesSourcesWithRuler();
    const hasLotexDatasources = !isEmpty(rulesSourcesWithRuler);
    // @PERCONA
    // Simplified conditions by adding these two consts below
    const showTemplateRuleDisclaimer = enabledTypes.includes(RuleFormType.templated);
    const showGrafanaManagedRuleDisclaimer = !showTemplateRuleDisclaimer && enabledTypes.includes(RuleFormType.grafana);
    useEffect(() => {
        dispatch(fetchAllPromBuildInfoAction());
    }, []);
    const styles = useStyles2(getStyles);
    const handleChange = (type) => {
        onChange(type);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Stack, { direction: "row", gap: 2 },
            enabledTypes.includes(RuleFormType.templated) && (React.createElement(TemplatedAlertRuleType, { selected: selected === RuleFormType.templated, onClick: onChange })),
            enabledTypes.includes(RuleFormType.grafana) && (React.createElement(GrafanaManagedRuleType, { selected: selected === RuleFormType.grafana, onClick: handleChange })),
            enabledTypes.includes(RuleFormType.cloudAlerting) && (React.createElement(MimirFlavoredType, { selected: selected === RuleFormType.cloudAlerting, onClick: handleChange, disabled: !hasLotexDatasources }))),
        showTemplateRuleDisclaimer && (React.createElement("small", { className: styles.meta }, "Select \u201CPercona templated\u201D for an easier alert rule setup.")),
        !showTemplateRuleDisclaimer && showGrafanaManagedRuleDisclaimer && (React.createElement("small", { className: styles.meta }, "Select \u201CGrafana managed\u201D unless you have a Mimir, Loki or Cortex data source with the Ruler API enabled."))));
};
const getStyles = (theme) => ({
    meta: css `
    color: ${theme.colors.text.disabled};
  `,
});
export { RuleTypePicker };
//# sourceMappingURL=RuleTypePicker.js.map