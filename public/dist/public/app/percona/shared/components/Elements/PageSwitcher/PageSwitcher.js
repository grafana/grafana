import { cx } from '@emotion/css';
import React from 'react';
import { Field } from 'react-final-form';
import { useStyles2 } from '@grafana/ui';
import { RadioButton } from 'app/percona/shared/components/Form/RadioButtonGroup/RadioButton';
import { getStyles } from './PageSwitcher.styles';
export const PageSwitcher = ({ values, className }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: cx(styles.pageSwitcherWrapper, className) }, values.map((item) => (React.createElement(Field, { name: `${item.name}`, component: "input", type: "radio", key: `radio-field-${item.value}`, value: item.value }, ({ input }) => (React.createElement(RadioButton, Object.assign({}, input, { onChange: () => {
            item.onChange && item.onChange();
            input.onChange({ target: { value: input.value } });
        } }), item.label)))))));
};
//# sourceMappingURL=PageSwitcher.js.map