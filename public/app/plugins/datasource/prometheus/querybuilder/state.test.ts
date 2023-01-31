import { CoreApp } from '@grafana/data';

import { PromQuery } from '../types';

import { QueryEditorMode } from './shared/types';
import { changeEditorMode, getQueryWithDefaults } from './state';

describe('getQueryWithDefaults(', () => {
  it('should set defaults', () => {
    expect(getQueryWithDefaults({ refId: 'A' } as PromQuery, CoreApp.Dashboard)).toEqual({
      editorMode: 'builder',
      expr: '',
      legendFormat: '__auto',
      range: true,
      refId: 'A',
    });
  });

  it('should set both range and instant to true when in Explore', () => {
    expect(getQueryWithDefaults({ refId: 'A' } as PromQuery, CoreApp.Explore)).toEqual({
      editorMode: 'builder',
      expr: '',
      legendFormat: '__auto',
      range: true,
      instant: true,
      refId: 'A',
    });
  });

  it('should not set both instant and range for Prometheus queries in Alert Creation', () => {
    expect(
      getQueryWithDefaults({ refId: 'A', range: true, instant: true } as PromQuery, CoreApp.UnifiedAlerting)
    ).toEqual({
      editorMode: 'builder',
      expr: '',
      legendFormat: '__auto',
      range: true,
      instant: false,
      refId: 'A',
    });
  });

  it('changing editor mode with blank query should change default', () => {
    changeEditorMode({ refId: 'A', expr: '' }, QueryEditorMode.Code, (query) => {
      expect(query.editorMode).toBe(QueryEditorMode.Code);
    });

    expect(getQueryWithDefaults({ refId: 'A' } as PromQuery, CoreApp.Dashboard).editorMode).toEqual(
      QueryEditorMode.Code
    );
  });

  it('should return default editor mode when it is provided', () => {
    expect(getQueryWithDefaults({ refId: 'A' } as PromQuery, CoreApp.Dashboard, QueryEditorMode.Code)).toEqual({
      editorMode: 'code',
      expr: '',
      legendFormat: '__auto',
      range: true,
      refId: 'A',
    });
  });
});
