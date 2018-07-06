import _ from 'lodash';

export class SqlPartDef {
  type: string;
  style: string;
  label: string;
  params: any[];
  defaultParams: any[];
  wrapOpen: string;
  wrapClose: string;
  separator: string;
  renderer: any;
  category: any;
  addStrategy: any;

  constructor(options: any) {
    this.type = options.type;
    if (options.label) {
      this.label = options.label;
    } else {
      this.label = this.type[0].toUpperCase() + this.type.substring(1) + ':';
    }
    this.style = options.style;
    if (this.style === 'function') {
      this.wrapOpen = '(';
      this.wrapClose = ')';
      this.separator = ', ';
    } else {
      this.wrapOpen = ' ';
      this.wrapClose = ' ';
      this.separator = ' ';
    }
    this.params = options.params;
    this.defaultParams = options.defaultParams;
    this.renderer = options.renderer;
    this.category = options.category;
    this.addStrategy = options.addStrategy;
  }
}

export class SqlPart {
  part: any;
  def: SqlPartDef;
  params: any[];
  label: string;
  name: string;

  constructor(part: any, def: any) {
    this.part = part;
    this.def = def;
    if (!this.def) {
      throw { message: 'Could not find sql part ' + part.type };
    }

    if (part.name) {
      this.name = part.name;
      this.label = def.label + ' ' + part.name;
    } else {
      this.name = '';
      this.label = def.label;
    }

    part.params = part.params || _.clone(this.def.defaultParams);
    this.params = part.params;
  }

  render(innerExpr: string) {
    return this.def.renderer(this, innerExpr);
  }
}

export function functionRenderer(part, innerExpr) {
  var str = part.def.type + '(';
  var parameters = _.map(part.params, (value, index) => {
    var paramType = part.def.params[index];
    if (paramType.type === 'time') {
      if (value === 'auto') {
        value = '$__interval';
      }
    }
    if (paramType.quote === 'single') {
      return "'" + value + "'";
    } else if (paramType.quote === 'double') {
      return '"' + value + '"';
    }

    return value;
  });

  if (innerExpr) {
    parameters.unshift(innerExpr);
  }
  return str + parameters.join(', ') + ')';
}

export function suffixRenderer(part, innerExpr) {
  return innerExpr + ' ' + part.params[0];
}

export function identityRenderer(part, innerExpr) {
  return part.params[0];
}
