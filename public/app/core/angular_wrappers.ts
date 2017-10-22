import { react2AngularDirective } from 'app/core/utils/react2angular';
import { PasswordStrength } from './ui/PasswordStrength';

export function registerAngularDirectives() {

  react2AngularDirective('passwordStrength', PasswordStrength, ['password']);

}
