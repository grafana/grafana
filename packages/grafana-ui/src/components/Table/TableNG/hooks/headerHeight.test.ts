import { renderHook } from '@testing-library/react';

import { TABLE } from '../constants';
import { createTypographyContext } from '../utils/typography';

import { useHeaderHeight } from './headerHeight';
import { setupData } from './testHelpers';

describe('useHeaderHeight', () => {
  const typographyCtx = createTypographyContext(14, 'sans-serif');

  it('should return 0 when no header is present', () => {
    const { fields } = setupData();
    const { result } = renderHook(() => {
      return useHeaderHeight({
        fields,
        columnWidths: [],
        enabled: false,
        typographyCtx,
        sortColumns: [],
      });
    });
    expect(result.current).toBe(0);
  });

  it('should return the default height when wrap is disabled', () => {
    const { fields } = setupData();
    const { result } = renderHook(() => {
      return useHeaderHeight({
        fields,
        columnWidths: [],
        enabled: true,
        typographyCtx,
        sortColumns: [],
      });
    });
    expect(result.current).toBe(TABLE.HEADER_HEIGHT);
  });

  it('should return the appropriate height for wrapped text', () => {
    const { fields } = setupData();
    const { result } = renderHook(() => {
      return useHeaderHeight({
        fields: fields.map((field) => {
          if (field.name === 'name') {
            return {
              ...field,
              name: 'Longer name that needs wrapping',
              config: {
                ...field.config,
                custom: {
                  ...field.config?.custom,
                  wrapHeaderText: true,
                },
              },
            };
          }
          return field;
        }),
        columnWidths: [100, 100, 100],
        enabled: true,
        typographyCtx: { ...typographyCtx, avgCharWidth: 5, measureHeight: jest.fn(() => 44) },
        sortColumns: [],
      });
    });

    expect(result.current).toBe(50);
  });

  it('should calculate the available width for a header cell based on the icons rendered within it', () => {
    const heightFn = jest.fn(() => 20);

    const { fields } = setupData();

    let modifiedFields = fields.map((field) => {
      if (field.name === 'name') {
        return {
          ...field,
          name: 'Longer name that needs wrapping',
          config: {
            ...field.config,
            custom: {
              ...field.config?.custom,
              wrapHeaderText: true,
            },
          },
        };
      }
      return field;
    });

    renderHook(() => {
      return useHeaderHeight({
        fields: modifiedFields,
        columnWidths: [100, 100, 100],
        enabled: true,
        typographyCtx: { ...typographyCtx, measureHeight: heightFn },
        sortColumns: [],
        showTypeIcons: false,
      });
    });

    expect(heightFn).toHaveBeenCalledWith('Longer name that needs wrapping', 86, modifiedFields[0], -1, 22);

    modifiedFields = fields.map((field) => {
      if (field.name === 'name') {
        return {
          ...field,
          name: 'Longer name that needs wrapping',
          config: {
            ...field.config,
            custom: {
              ...field.config?.custom,
              filterable: true,
              wrapHeaderText: true,
            },
          },
        };
      }
      return field;
    });

    renderHook(() => {
      return useHeaderHeight({
        fields: modifiedFields,
        columnWidths: [100, 100, 100],
        enabled: true,
        typographyCtx: { ...typographyCtx, measureHeight: heightFn },
        sortColumns: [{ columnKey: 'Longer name that needs wrapping', direction: 'ASC' }],
        showTypeIcons: true,
      });
    });

    // colWidth 100 - chrome 13 - 3 icons (filter + sort + type) * 22 = 21, floor - 1 = 20.
    expect(heightFn).toHaveBeenCalledWith('Longer name that needs wrapping', 20, modifiedFields[0], -1, 22);
  });

  it('does not throw if a field has been deleted but the colWidth has not yet been updated', () => {
    const { fields } = setupData();
    const { result } = renderHook(() => {
      return useHeaderHeight({
        fields,
        columnWidths: [100, 100, 100, 100],
        enabled: true,
        typographyCtx,
        sortColumns: [],
      });
    });
    expect(result.current).toBe(TABLE.HEADER_HEIGHT);
  });
});
