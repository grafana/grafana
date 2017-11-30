import { react2AngularDirective } from 'app/core/utils/react2angular';
import { PasswordStrength } from './components/PasswordStrength';
import PageHeader from './components/PageHeader';

export function registerAngularDirectives() {

  react2AngularDirective('passwordStrength', PasswordStrength, ['password']);
  react2AngularDirective('pageHeader', PageHeader, ['model', "noTabs"]);

}
