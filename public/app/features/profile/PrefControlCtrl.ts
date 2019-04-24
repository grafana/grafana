import { react2AngularDirective } from 'app/core/utils/react2angular';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';

react2AngularDirective('prefsControl', SharedPreferences, ['resourceUri']);
