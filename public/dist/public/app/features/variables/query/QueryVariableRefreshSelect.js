import React, { useMemo, useState } from 'react';
import { VariableRefresh } from '@grafana/data';
import { Field, RadioButtonGroup, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
const REFRESH_OPTIONS = [
    { label: 'On dashboard load', value: VariableRefresh.onDashboardLoad },
    { label: 'On time range change', value: VariableRefresh.onTimeRangeChanged },
];
export function QueryVariableRefreshSelect({ onChange, refresh }) {
    const theme = useTheme2();
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    useMediaQueryChange({
        breakpoint: theme.breakpoints.values.sm,
        onChange: (e) => {
            setIsSmallScreen(!e.matches);
        },
    });
    const value = useMemo(() => { var _a, _b; return (_b = (_a = REFRESH_OPTIONS.find((o) => o.value === refresh)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : REFRESH_OPTIONS[0].value; }, [refresh]);
    return (React.createElement(Field, { label: "Refresh", description: "When to update the values of this variable" },
        React.createElement(RadioButtonGroup, { options: REFRESH_OPTIONS, onChange: onChange, value: value, size: isSmallScreen ? 'sm' : 'md' })));
}
//# sourceMappingURL=QueryVariableRefreshSelect.js.map