import React, { PureComponent } from 'react';
import { AdHocVariableModel } from '../../templating/variable';
import { VariableEditorProps } from '../editor/types';

export interface Props extends VariableEditorProps<AdHocVariableModel> {}

export class AdHocVariableEditor extends PureComponent<Props> {
  render() {
    return (
      <>
        <div className="gf-form-group"></div>
      </>
    );
  }
}
