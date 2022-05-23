import { CoreApp } from '@grafana/data';

import { QueryEditorMode } from './shared/types';
import { changeEditorMode, getQueryWithDefaults } from './state';

describe('getQueryWithDefaults(', () => {
  it('should set defaults', () => {
    expect(getQueryWithDefaults({ refId: 'A' } as any, CoreApp.Dashboard, '9.0.0')).toEqual({
      pluginVersion: '9.0.0',
      editorMode: 'builder',
      expr: '',
      legendFormat: '__auto',
      range: true,
      refId: 'A',
    });
  });

  it('should set both range and instant to true when in Explore', () => {
    expect(getQueryWithDefaults({ refId: 'A' } as any, CoreApp.Explore, '9.0.0')).toEqual({
      pluginVersion: '9.0.0',
      editorMode: 'builder',
      expr: '',
      legendFormat: '__auto',
      range: true,
      instant: true,
      refId: 'A',
    });
  });

  it('should not set a schema version for a query with an expression', () => {
    expect(getQueryWithDefaults({ refId: 'A', expr: 'ALERTS{}' } as any, CoreApp.Dashboard, '9.0.0')).toEqual({
      editorMode: 'code',
      expr: 'ALERTS{}',
      range: true,
      refId: 'A',
    });
  });

  it('changing editor mode with blank query should change default', () => {
    changeEditorMode({ refId: 'A', expr: '' }, QueryEditorMode.Code, (query) => {
      expect(query.editorMode).toBe(QueryEditorMode.Code);
    });

    expect(getQueryWithDefaults({ refId: 'A' } as any, CoreApp.Dashboard, '9.0.0').editorMode).toEqual(
      QueryEditorMode.Code
    );
  });
});
