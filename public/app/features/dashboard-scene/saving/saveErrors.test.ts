import { type FetchError } from '@grafana/runtime';

import { type MetaStatus } from '../../apiserver/types';

import { getSaveDashboardErrorInfo } from './saveErrors';

function k8sError(status: Partial<MetaStatus>, httpStatus = 400): FetchError<MetaStatus> {
  return {
    status: httpStatus,
    statusText: 'Bad Request',
    config: { url: '/apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards/abc' },
    data: {
      kind: 'Status',
      apiVersion: 'v1',
      status: 'Failure',
      code: httpStatus,
      message: 'something went wrong',
      ...status,
    },
  };
}

describe('getSaveDashboardErrorInfo', () => {
  it('returns undefined when there is no error', () => {
    expect(getSaveDashboardErrorInfo(undefined)).toBeUndefined();
  });

  describe('apimachinery Status errors', () => {
    it('classifies reason Conflict as conflict so the overwrite affordance can be offered', () => {
      const info = getSaveDashboardErrorInfo(k8sError({ reason: 'Conflict', message: 'the object was deleted' }, 409));

      expect(info?.kind).toBe('conflict');
      expect(info?.message).toBe('the object was deleted');
    });

    it('classifies reason AlreadyExists as already-exists', () => {
      const info = getSaveDashboardErrorInfo(
        k8sError({ reason: 'AlreadyExists', message: 'the resource already exists' }, 409)
      );

      expect(info?.kind).toBe('already-exists');
    });

    it('classifies reason Forbidden as forbidden and keeps the server message', () => {
      const info = getSaveDashboardErrorInfo(
        k8sError({ reason: 'Forbidden', message: 'dashboards.dashboard.grafana.app is forbidden' }, 403)
      );

      expect(info?.kind).toBe('forbidden');
      expect(info?.message).toBe('dashboards.dashboard.grafana.app is forbidden');
    });

    it('lists each Invalid cause as "field: message"', () => {
      const info = getSaveDashboardErrorInfo(
        k8sError(
          {
            reason: 'Invalid',
            message: 'Dashboard.dashboard.grafana.app "abc" is invalid',
            details: {
              causes: [
                { field: 'spec.title', message: 'title cannot be empty', reason: 'FieldValueRequired' },
                { field: 'spec.panels[0].id', message: 'must be unique', reason: 'FieldValueDuplicate' },
              ],
            },
          },
          422
        )
      );

      expect(info?.kind).toBe('invalid');
      expect(info?.causes).toEqual(['spec.title: title cannot be empty', 'spec.panels[0].id: must be unique']);
    });

    it('lists an Invalid cause without a field as the bare message', () => {
      const info = getSaveDashboardErrorInfo(
        k8sError({ reason: 'Invalid', details: { causes: [{ message: 'schema version is not supported' }] } }, 422)
      );

      expect(info?.causes).toEqual(['schema version is not supported']);
    });

    it('drops Invalid causes that carry no message', () => {
      const info = getSaveDashboardErrorInfo(
        k8sError(
          { reason: 'Invalid', details: { causes: [{ field: 'spec.title' }, { message: 'must be unique' }] } },
          422
        )
      );

      expect(info?.causes).toEqual(['must be unique']);
    });

    it('falls back to the Status message when Invalid carries no causes', () => {
      const info = getSaveDashboardErrorInfo(k8sError({ reason: 'Invalid', message: 'dashboard is invalid' }, 422));

      expect(info?.kind).toBe('invalid');
      expect(info?.causes).toEqual([]);
      expect(info?.message).toBe('dashboard is invalid');
    });

    it('classifies an unrecognised reason as unknown but keeps the server message', () => {
      const info = getSaveDashboardErrorInfo(
        k8sError({ reason: 'InternalError', message: 'failed to write to unified storage' }, 500)
      );

      expect(info?.kind).toBe('unknown');
      expect(info?.message).toBe('failed to write to unified storage');
    });
  });

  describe('legacy dashboard error shapes', () => {
    it.each([
      ['version-mismatch', 'conflict'],
      ['name-exists', 'already-exists'],
      ['plugin-dashboard', 'plugin-dashboard'],
    ])('classifies legacy status %s as %s', (legacyStatus, expectedKind) => {
      const error: FetchError = {
        status: 412,
        statusText: 'Precondition Failed',
        config: { url: '/api/dashboards/db' },
        data: { status: legacyStatus, message: 'sad face' },
      };

      expect(getSaveDashboardErrorInfo(error)?.kind).toBe(expectedKind);
    });
  });

  describe('message never renders blank', () => {
    it('uses data.message when the error has no top level message', () => {
      const info = getSaveDashboardErrorInfo(k8sError({ message: 'quota exceeded' }, 429));

      expect(info?.message).toBe('quota exceeded');
    });

    it('falls back to status and statusText when the response body carries no message', () => {
      const error: FetchError = {
        status: 502,
        statusText: 'Bad Gateway',
        config: { url: '/apis/dashboard.grafana.app' },
        data: {},
      };

      expect(getSaveDashboardErrorInfo(error)?.message).toBe('502 Bad Gateway');
    });

    it('falls back to a generic message when there is no message, statusText or body', () => {
      const error: FetchError = {
        status: 0,
        config: { url: '/apis/dashboard.grafana.app' },
        data: undefined,
      };

      expect(getSaveDashboardErrorInfo(error)?.message).toBe('An unexpected error occurred while saving.');
    });

    it('uses the message of a plain Error', () => {
      const info = getSaveDashboardErrorInfo(new Error('Invalid dashboard version'));

      expect(info?.kind).toBe('unknown');
      expect(info?.message).toBe('Invalid dashboard version');
    });

    it('falls back to a generic message for a thrown value that is not an error', () => {
      const info = getSaveDashboardErrorInfo('boom');

      expect(info?.kind).toBe('unknown');
      expect(info?.message).toBe('An unexpected error occurred while saving.');
    });
  });
});
