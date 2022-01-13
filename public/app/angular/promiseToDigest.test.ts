import { IScope } from 'angular';
import { promiseToDigest } from './promiseToDigest';

describe('promiseToDigest', () => {
  describe('when called with a promise that resolves', () => {
    it('then evalAsync should be called on $scope', async () => {
      const $scope: IScope = ({ $evalAsync: jest.fn() } as any) as IScope;

      await promiseToDigest($scope)(Promise.resolve(123));

      expect($scope.$evalAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('when called with a promise that rejects', () => {
    it('then evalAsync should be called on $scope', async () => {
      const $scope: IScope = ({ $evalAsync: jest.fn() } as any) as IScope;

      try {
        await promiseToDigest($scope)(Promise.reject(123));
      } catch (error) {
        expect(error).toEqual(123);
        expect($scope.$evalAsync).toHaveBeenCalledTimes(1);
      }
    });
  });
});
