import { __awaiter } from "tslib";
import React from 'react';
import { Select } from '@grafana/ui';
export class SelectValueEditor extends React.PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            isLoading: true,
            options: [],
        };
        this.updateOptions = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { item } = this.props;
            const { settings } = item;
            let options = ((_a = item.settings) === null || _a === void 0 ? void 0 : _a.options) || [];
            if (settings === null || settings === void 0 ? void 0 : settings.getOptions) {
                options = yield settings.getOptions(this.props.context);
            }
            if (this.state.options !== options) {
                this.setState({
                    isLoading: false,
                    options,
                });
            }
        });
    }
    componentDidMount() {
        this.updateOptions();
    }
    componentDidUpdate(oldProps) {
        var _a, _b, _c, _d;
        const old = (_a = oldProps.item) === null || _a === void 0 ? void 0 : _a.settings;
        const now = (_b = this.props.item) === null || _b === void 0 ? void 0 : _b.settings;
        if (old !== now) {
            this.updateOptions();
        }
        else if (now === null || now === void 0 ? void 0 : now.getOptions) {
            const old = (_c = oldProps.context) === null || _c === void 0 ? void 0 : _c.data;
            const now = (_d = this.props.context) === null || _d === void 0 ? void 0 : _d.data;
            if (old !== now) {
                this.updateOptions();
            }
        }
    }
    render() {
        const { options, isLoading } = this.state;
        const { value, onChange, item } = this.props;
        const { settings } = item;
        let current = options.find((v) => v.value === value);
        if (!current && value) {
            current = {
                label: `${value}`,
                value,
            };
        }
        return (React.createElement(Select, { isLoading: isLoading, value: current, defaultValue: value, allowCustomValue: settings === null || settings === void 0 ? void 0 : settings.allowCustomValue, isClearable: settings === null || settings === void 0 ? void 0 : settings.isClearable, onChange: (e) => onChange(e === null || e === void 0 ? void 0 : e.value), options: options }));
    }
}
//# sourceMappingURL=select.js.map