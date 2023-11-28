import { clone } from 'lodash';
export class SqlPartDef {
    constructor(options) {
        this.type = options.type;
        if (options.label) {
            this.label = options.label;
        }
        else {
            this.label = this.type[0].toUpperCase() + this.type.substring(1) + ':';
        }
        this.style = options.style;
        if (this.style === 'function') {
            this.wrapOpen = '(';
            this.wrapClose = ')';
            this.separator = ', ';
        }
        else {
            this.wrapOpen = ' ';
            this.wrapClose = ' ';
            this.separator = ' ';
        }
        this.params = options.params;
        this.defaultParams = options.defaultParams;
    }
}
export class SqlPart {
    constructor(part, def) {
        this.part = part;
        this.def = def;
        if (!this.def) {
            throw { message: 'Could not find sql part ' + part.type };
        }
        this.datatype = part.datatype;
        if (part.name) {
            this.name = part.name;
            this.label = def.label + ' ' + part.name;
        }
        else {
            this.name = '';
            this.label = def.label;
        }
        part.params = part.params || clone(this.def.defaultParams);
        this.params = part.params;
    }
    updateParam(strValue, index) {
        // handle optional parameters
        if (strValue === '' && this.def.params[index].optional) {
            this.params.splice(index, 1);
        }
        else {
            this.params[index] = strValue;
        }
        this.part.params = this.params;
    }
}
//# sourceMappingURL=sql_part.js.map