import { react2AngularDirective } from 'app/core/utils/react2angular';
import { PasswordStrength } from './components/PasswordStrength';
import PageHeader from './components/PageHeader/PageHeader';
import EmptyListCTA from './components/EmptyListCTA/EmptyListCTA';
import LoginBackground from './components/Login/LoginBackground';
import { SearchResult } from './components/search/SearchResult';
import { TagFilter } from './components/TagFilter/TagFilter';
import UserPicker from './components/Picker/UserPicker';
import DashboardPermissions from './components/Permissions/DashboardPermissions';
import { ThresholdForm } from './components/ThresholdManager/ThresholdForm';
import { ThresholdManager } from './components/ThresholdManager/ThresholdManager';

export function registerAngularDirectives() {
  react2AngularDirective('passwordStrength', PasswordStrength, ['password']);
  react2AngularDirective('pageHeader', PageHeader, ['model', 'noTabs']);
  react2AngularDirective('emptyListCta', EmptyListCTA, ['model']);
  react2AngularDirective('loginBackground', LoginBackground, []);
  react2AngularDirective('searchResult', SearchResult, []);
  react2AngularDirective('tagFilter', TagFilter, [
    'tags',
    ['onSelect', { watchDepth: 'reference' }],
    ['tagOptions', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('selectUserPicker', UserPicker, ['backendSrv', 'handlePicked']);
  react2AngularDirective('dashboardPermissions', DashboardPermissions, ['backendSrv', 'dashboardId', 'folder']);
  react2AngularDirective('thresholdForm', ThresholdForm, [
    'thresholds',
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
  ]);
  react2AngularDirective('thresholdManager', ThresholdManager, [
    'thresholds',
    'className',
    ['yPos', { watchDepth: 'reference', wrapApply: true }],
    ['yPosInvert', { watchDepth: 'reference', wrapApply: true }],
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
  ]);
}
