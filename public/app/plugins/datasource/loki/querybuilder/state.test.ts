import { QueryEditorMode } from '@grafana/plugin-ui';

import { changeEditorMode, getQueryWithDefaults } from './state';

describe('getQueryWithDefaults(', () => {
  it('should set defaults', () => {
    expect(getQueryWithDefaults({ refId: 'A', expr: '' })).toEqual({
      editorMode: 'builder',
      expr: '',
      queryType: 'range',
      refId: 'A',
    });
  });

  it('changing editor mode with blank query should change default', () => {
    changeEditorMode({ refId: 'A', expr: '' }, QueryEditorMode.Code, (query) => {
      expect(query.editorMode).toBe(QueryEditorMode.Code);
    });

    expect(getQueryWithDefaults({ refId: 'A', expr: '' }).editorMode).toEqual(QueryEditorMode.Code);
  });
});
