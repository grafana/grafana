import {
  DENY_ALL_FOLDER_PREDEFINED,
  DENY_ALL_GLOBAL_PREDEFINED,
  DENY_ALL_PREDEFINED,
} from 'app/features/apiserver/types';

import { serializeIgnorePredefinedVariables } from './predefinedVariableDenyList';
import { formatPredefinedVariablesAnnotationLabel } from './predefinedVariablesMetadata';

describe('formatPredefinedVariablesAnnotationLabel', () => {
  it('labels absent annotation as All', () => {
    expect(formatPredefinedVariablesAnnotationLabel(undefined)).toBe('All');
  });

  it('labels empty denylist as All', () => {
    expect(formatPredefinedVariablesAnnotationLabel(serializeIgnorePredefinedVariables([]))).toBe('All');
  });

  it('labels deny-all as None', () => {
    expect(formatPredefinedVariablesAnnotationLabel(serializeIgnorePredefinedVariables([DENY_ALL_PREDEFINED]))).toBe(
      'None'
    );
  });

  it('labels folder:* deny as Global', () => {
    expect(
      formatPredefinedVariablesAnnotationLabel(serializeIgnorePredefinedVariables([DENY_ALL_FOLDER_PREDEFINED]))
    ).toBe('Global');
  });

  it('labels global:* deny as Folder', () => {
    expect(
      formatPredefinedVariablesAnnotationLabel(serializeIgnorePredefinedVariables([DENY_ALL_GLOBAL_PREDEFINED]))
    ).toBe('Folder');
  });

  it('labels custom lists as Custom', () => {
    expect(formatPredefinedVariablesAnnotationLabel(serializeIgnorePredefinedVariables(['env']))).toBe('Custom');
  });
});
