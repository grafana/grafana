import { IScope } from 'angular';

export interface Scope extends IScope {
  [key: string]: any;
}
