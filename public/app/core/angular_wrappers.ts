import { react2AngularDirective } from 'app/core/utils/react2angular';
import { PasswordStrength } from './components/PasswordStrength';
import { FormDropdown } from 'app/core/components/form_dropdown/FormDropdown';

export function registerAngularDirectives() {

  react2AngularDirective('passwordStrength', PasswordStrength, ['password']);
  react2AngularDirective('gfFormDropdownReact', FormDropdown, [
    'value', 'options', 'cssClass', 'labelMode', 'allowCustom', 'lookupText', 'cache',
    ['getOptions', { watchDepth: 'reference', wrapApply: true }],
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
  ]);
}
