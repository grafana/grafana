import { react2AngularDirective } from 'app/core/utils/react2angular';
import { PasswordStrength } from './components/PasswordStrength';
import PageHeader from './components/PageHeader';
import EmptyListCTA from './components/EmptyListCTA/EmptyListCTA';

export function registerAngularDirectives() {

  react2AngularDirective('passwordStrength', PasswordStrength, ['password']);
  react2AngularDirective('pageHeader', PageHeader, ['model', "noTabs"]);
  react2AngularDirective('emptyListCta', EmptyListCTA, ['model']);

}
