import { clone, each, map } from 'lodash';

export class QueryPartDef {
  type: string;
  params: any[];
  defaultParams: any[];
  renderer: any;
  category: any;
  addStrategy: any;

  constructor(options: any) {
    this.type = options.type;
    this.params = options.params;
    this.defaultParams = options.defaultParams;
    this.renderer = options.renderer;
    this.category = options.category;
    this.addStrategy = options.addStrategy;
  }
}

export class QueryPart {
  part: any;
  def: QueryPartDef;
  params: any[];
  text: string;

  constructor(part: any, def: any) {
    this.part = part;
    this.def = def;
    if (!this.def) {
      throw { message: 'Could not find query part ' + part.type };
    }

    part.params = part.params || clone(this.def.defaultParams);
    this.params = part.params;
    this.text = '';
    this.updateText();
  }

  render(innerExpr: string) {
    return this.def.renderer(this, innerExpr);
  }

  hasMultipleParamsInString(strValue: string, index: number) {
    if (strValue.indexOf(',') === -1) {
      return false;
    }

    return this.def.params[index + 1] && this.def.params[index + 1].optional;
  }

  updateParam(strValue: string, index: number) {
    // handle optional parameters
    // if string contains ',' and next param is optional, split and update both
    if (this.hasMultipleParamsInString(strValue, index)) {
      each(strValue.split(','), (partVal, idx) => {
        this.updateParam(partVal.trim(), idx);
      });
      return;
    }

    if (strValue === '' && this.def.params[index].optional) {
      this.params.splice(index, 1);
    } else {
      this.params[index] = strValue;
    }

    this.part.params = this.params;
    this.updateText();
  }

  updateText() {
    if (this.params.length === 0) {
      this.text = this.def.type + '()';
      return;
    }

    let text = this.def.type + '(';
    text += this.params.join(', ');
    text += ')';
    this.text = text;
  }
}

export function functionRenderer(part: any, innerExpr: string) {
  const str = part.def.type + '(';
  const parameters = map(part.params, (value, index) => {
    const paramType = part.def.params[index];
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

export function suffixRenderer(part: QueryPart, innerExpr: string) {
  return innerExpr + ' ' + part.params[0];
}

export function identityRenderer(part: QueryPart, innerExpr: string) {
  return part.params[0];
}

export function quotedIdentityRenderer(part: QueryPart, innerExpr: string) {
  return '"' + part.params[0] + '"';
}
