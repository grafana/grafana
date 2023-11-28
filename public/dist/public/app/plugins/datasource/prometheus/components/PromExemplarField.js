import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { usePrevious } from 'react-use';
import { IconButton, InlineLabel, Tooltip, useStyles2 } from '@grafana/ui';
export function PromExemplarField(_a) {
    var { datasource, onChange, query } = _a, rest = __rest(_a, ["datasource", "onChange", "query"]);
    const [error, setError] = useState(null);
    const styles = useStyles2(getStyles);
    const prevError = usePrevious(error);
    useEffect(() => {
        if (!datasource.exemplarsAvailable) {
            setError('Exemplars for this query are not available');
            onChange(false);
        }
        else if (query.instant && !query.range) {
            setError('Exemplars are not available for instant queries');
            onChange(false);
        }
        else {
            setError(null);
            // If error is cleared, we want to change exemplar to true
            if (prevError && !error) {
                onChange(true);
            }
        }
    }, [datasource.exemplarsAvailable, query.instant, query.range, onChange, prevError, error]);
    const iconButtonStyles = cx({
        [styles.activeIcon]: !!query.exemplar,
    }, styles.eyeIcon);
    return (React.createElement(InlineLabel, { width: "auto", "data-testid": rest['data-testid'] },
        React.createElement(Tooltip, { content: error !== null && error !== void 0 ? error : '' },
            React.createElement("div", { className: styles.iconWrapper },
                "Exemplars",
                React.createElement(IconButton, { name: "eye", tooltip: !!query.exemplar ? 'Disable query with exemplars' : 'Enable query with exemplars', disabled: !!error, className: iconButtonStyles, onClick: () => {
                        onChange(!query.exemplar);
                    } })))));
}
function getStyles(theme) {
    return {
        eyeIcon: css `
      margin-left: ${theme.spacing(2)};
    `,
        activeIcon: css `
      color: ${theme.colors.primary.main};
    `,
        iconWrapper: css `
      display: flex;
      align-items: center;
    `,
    };
}
//# sourceMappingURL=PromExemplarField.js.map