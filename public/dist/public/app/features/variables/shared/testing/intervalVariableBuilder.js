import { OptionsVariableBuilder } from './optionsVariableBuilder';
export class IntervalVariableBuilder extends OptionsVariableBuilder {
    withRefresh(refresh) {
        this.variable.refresh = refresh;
        return this;
    }
    withAuto(auto) {
        this.variable.auto = auto;
        return this;
    }
    withAutoCount(autoCount) {
        this.variable.auto_count = autoCount;
        return this;
    }
    withAutoMin(autoMin) {
        this.variable.auto_min = autoMin;
        return this;
    }
}
//# sourceMappingURL=intervalVariableBuilder.js.map