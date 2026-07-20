import {
  ALLOW_ALL_FOLDER_PREDEFINED,
  ALLOW_ALL_GLOBAL_PREDEFINED,
  ALLOW_ALL_PREDEFINED,
} from 'app/features/apiserver/types';

import { serializeUsePredefinedVariables } from './predefinedVariableAllowList';
import { formatPredefinedVariablesAnnotationLabel } from './predefinedVariablesMetadata';

describe('formatPredefinedVariablesAnnotationLabel', () => {
  it('labels absent annotation as Not set', () => {
    expect(formatPredefinedVariablesAnnotationLabel(undefined)).toBe('Not set');
  });

  it('labels allow-all as All', () => {
    expect(
      formatPredefinedVariablesAnnotationLabel(
        serializeUsePredefinedVariables({ predefinedVariablesAllowList: ALLOW_ALL_PREDEFINED })
      )
    ).toBe('All');
  });

  it('labels global sentinel as Global', () => {
    expect(
      formatPredefinedVariablesAnnotationLabel(
        serializeUsePredefinedVariables({ predefinedVariablesAllowList: [ALLOW_ALL_GLOBAL_PREDEFINED] })
      )
    ).toBe('Global');
  });

  it('labels folder sentinel as Folder', () => {
    expect(
      formatPredefinedVariablesAnnotationLabel(
        serializeUsePredefinedVariables({ predefinedVariablesAllowList: [ALLOW_ALL_FOLDER_PREDEFINED] })
      )
    ).toBe('Folder');
  });

  it('labels empty allowlist as None', () => {
    expect(
      formatPredefinedVariablesAnnotationLabel(serializeUsePredefinedVariables({ predefinedVariablesAllowList: [] }))
    ).toBe('None');
  });
});
