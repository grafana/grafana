import { IScope } from 'angular';

export const promiseToDigest = ($scope: IScope) => (promise: Promise<any>) => promise.finally($scope.$evalAsync);
