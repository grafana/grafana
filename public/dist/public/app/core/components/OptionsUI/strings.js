import { css } from '@emotion/css';
import React from 'react';
import { config } from '@grafana/runtime';
import { stylesFactory, Button, Icon, Input } from '@grafana/ui';
export class StringArrayEditor extends React.PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            showAdd: false,
        };
        this.onRemoveString = (index) => {
            const { value, onChange } = this.props;
            const copy = [...value];
            copy.splice(index, 1);
            onChange(copy);
        };
        this.onValueChange = (e, idx) => {
            if ('key' in e) {
                if (e.key !== 'Enter') {
                    return;
                }
            }
            const { value, onChange } = this.props;
            // Form event, or Enter
            const v = e.currentTarget.value.trim();
            if (idx < 0) {
                if (v) {
                    e.currentTarget.value = ''; // reset last value
                    onChange([...value, v]);
                }
                this.setState({ showAdd: false });
                return;
            }
            if (!v) {
                return this.onRemoveString(idx);
            }
            const copy = [...value];
            copy[idx] = v;
            onChange(copy);
        };
    }
    render() {
        var _a;
        const { value, item } = this.props;
        const { showAdd } = this.state;
        const styles = getStyles(config.theme2);
        const placeholder = ((_a = item.settings) === null || _a === void 0 ? void 0 : _a.placeholder) || 'Add text';
        return (React.createElement("div", null,
            value.map((v, index) => {
                return (React.createElement(Input, { className: styles.textInput, key: `${index}/${v}`, defaultValue: v || '', onBlur: (e) => this.onValueChange(e, index), onKeyDown: (e) => this.onValueChange(e, index), suffix: React.createElement(Icon, { className: styles.trashIcon, name: "trash-alt", onClick: () => this.onRemoveString(index) }) }));
            }),
            showAdd ? (React.createElement(Input, { autoFocus: true, className: styles.textInput, placeholder: placeholder, defaultValue: '', onBlur: (e) => this.onValueChange(e, -1), onKeyDown: (e) => this.onValueChange(e, -1), suffix: React.createElement(Icon, { name: "plus-circle" }) })) : (React.createElement(Button, { icon: "plus", size: "sm", variant: "secondary", onClick: () => this.setState({ showAdd: true }) }, placeholder))));
    }
}
const getStyles = stylesFactory((theme) => {
    return {
        textInput: css `
      margin-bottom: 5px;
      &:hover {
        border: 1px solid ${theme.components.input.borderHover};
      }
    `,
        trashIcon: css `
      color: ${theme.colors.text.secondary};
      cursor: pointer;

      &:hover {
        color: ${theme.colors.text};
      }
    `,
    };
});
//# sourceMappingURL=strings.js.map