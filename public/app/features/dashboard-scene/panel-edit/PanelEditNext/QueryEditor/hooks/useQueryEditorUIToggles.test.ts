import { act, renderHook } from '@testing-library/react';

import { QueryOptionField } from '../types';

import { useQueryEditorUIToggles } from './useQueryEditorUIToggles';

describe('useQueryEditorUIToggles', () => {
  describe('openSidebar', () => {
    it('sets isQueryOptionsOpen to true', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.openSidebar());

      expect(result.current.isQueryOptionsOpen).toBe(true);
    });

    it('sets focusedField when a field is provided', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.openSidebar(QueryOptionField.maxDataPoints));

      expect(result.current.focusedField).toBe(QueryOptionField.maxDataPoints);
    });

    it('leaves existing focusedField unchanged when called without argument', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.openSidebar(QueryOptionField.maxDataPoints));
      act(() => result.current.openSidebar());

      expect(result.current.focusedField).toBe(QueryOptionField.maxDataPoints);
    });
  });

  describe('closeSidebar', () => {
    it('sets isQueryOptionsOpen to false', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.openSidebar());
      act(() => result.current.closeSidebar());

      expect(result.current.isQueryOptionsOpen).toBe(false);
    });

    it('clears focusedField to null', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.openSidebar(QueryOptionField.maxDataPoints));
      act(() => result.current.closeSidebar());

      expect(result.current.focusedField).toBeNull();
    });
  });

  describe('resetUIToggles', () => {
    it('sets showingDatasourceHelp to false', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.toggleDatasourceHelp());
      expect(result.current.showingDatasourceHelp).toBe(true);

      act(() => result.current.resetUIToggles());

      expect(result.current.showingDatasourceHelp).toBe(false);
    });

    it('resets transformTogglesState to { showHelp: false, showDebug: false }', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.toggleHelp());
      act(() => result.current.toggleDebug());
      expect(result.current.transformTogglesState).toEqual({ showHelp: true, showDebug: true });

      act(() => result.current.resetUIToggles());

      expect(result.current.transformTogglesState).toEqual({ showHelp: false, showDebug: false });
    });

    it('does NOT change isQueryOptionsOpen', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.openSidebar());
      expect(result.current.isQueryOptionsOpen).toBe(true);

      act(() => result.current.resetUIToggles());

      expect(result.current.isQueryOptionsOpen).toBe(true);
    });
  });

  describe('toggleDatasourceHelp', () => {
    it('flips showingDatasourceHelp on each call', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.toggleDatasourceHelp());
      expect(result.current.showingDatasourceHelp).toBe(true);

      act(() => result.current.toggleDatasourceHelp());
      expect(result.current.showingDatasourceHelp).toBe(false);
    });
  });

  describe('toggleHelp / toggleDebug', () => {
    it('toggleHelp flips showHelp independently of showDebug', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.toggleHelp());

      expect(result.current.transformTogglesState).toEqual({ showHelp: true, showDebug: false });
    });

    it('toggleDebug flips showDebug independently of showHelp', () => {
      const { result } = renderHook(() => useQueryEditorUIToggles());

      act(() => result.current.toggleDebug());

      expect(result.current.transformTogglesState).toEqual({ showHelp: false, showDebug: true });
    });
  });
});
