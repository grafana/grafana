import { VariableBuilder } from './variableBuilder';
export class OptionsVariableBuilder extends VariableBuilder {
    withOptions(...options) {
        this.variable.options = [];
        for (let index = 0; index < options.length; index++) {
            const option = options[index];
            if (typeof option === 'string') {
                this.variable.options.push({
                    text: option,
                    value: option,
                    selected: false,
                });
            }
            else {
                this.variable.options.push(Object.assign(Object.assign({}, option), { selected: false }));
            }
        }
        return this;
    }
    withoutOptions() {
        this.variable.options = undefined;
        return this;
    }
    withCurrent(text, value) {
        this.variable.current = {
            text,
            value: value !== null && value !== void 0 ? value : text,
            selected: true,
        };
        return this;
    }
    withQuery(query) {
        this.variable.query = query;
        return this;
    }
}
//# sourceMappingURL=optionsVariableBuilder.js.map