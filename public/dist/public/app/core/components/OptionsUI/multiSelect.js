import { __awaiter } from "tslib";
import React from 'react';
import { MultiSelect } from '@grafana/ui';
/**
 * MultiSelect for options UI
 * @alpha
 */
export class MultiSelectValueEditor extends React.PureComponent {
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
        return (React.createElement(MultiSelect, { isLoading: isLoading, value: value, defaultValue: value, allowCustomValue: settings === null || settings === void 0 ? void 0 : settings.allowCustomValue, onChange: (e) => {
                onChange(e.map((v) => v.value).flatMap((v) => (v !== undefined ? [v] : [])));
            }, options: options }));
    }
}
//# sourceMappingURL=multiSelect.js.map