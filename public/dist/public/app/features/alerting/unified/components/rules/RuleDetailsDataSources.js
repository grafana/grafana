import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { getDataSourceSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { isCloudRulesSource } from '../../utils/datasource';
import { isGrafanaRulerRule } from '../../utils/rules';
import { DetailsField } from '../DetailsField';
export function RuleDetailsDataSources(props) {
    const { rulesSource, rule } = props;
    const styles = useStyles2(getStyles);
    const dataSources = useMemo(() => {
        if (isCloudRulesSource(rulesSource)) {
            return [{ name: rulesSource.name, icon: rulesSource.meta.info.logos.small }];
        }
        if (isGrafanaRulerRule(rule.rulerRule)) {
            const { data } = rule.rulerRule.grafana_alert;
            const unique = data.reduce((dataSources, query) => {
                const ds = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
                if (!ds || ds.uid === ExpressionDatasourceUID) {
                    return dataSources;
                }
                dataSources[ds.name] = { name: ds.name, icon: ds.meta.info.logos.small };
                return dataSources;
            }, {});
            return Object.values(unique);
        }
        return [];
    }, [rule, rulesSource]);
    if (dataSources.length === 0) {
        return null;
    }
    return (React.createElement(DetailsField, { label: "Data source" }, dataSources.map(({ name, icon }, index) => (React.createElement("div", { key: name },
        icon && (React.createElement(React.Fragment, null,
            React.createElement("img", { alt: `${name} datasource logo`, className: styles.dataSourceIcon, src: icon }),
            ' ')),
        name)))));
}
function getStyles(theme) {
    const size = theme.spacing(2);
    return {
        dataSourceIcon: css `
      width: ${size};
      height: ${size};
    `,
    };
}
//# sourceMappingURL=RuleDetailsDataSources.js.map