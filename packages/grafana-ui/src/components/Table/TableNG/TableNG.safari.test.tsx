import { render, screen } from '@testing-library/react';

import { applyFieldOverrides, createTheme, type DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { TableNG } from './TableNG';

// Safari 26 has a rendering bug that TableNG works around by wrapping the table in a
// `contain: strict` container (Safari26Wrapper). IS_SAFARI_26 is derived from the user agent at
// module load, so we force it on here to exercise that path. Scoped to its own file so the override
// doesn't leak into the main suite; getGridStyles keeps the real value via requireActual.
jest.mock('./styles', () => {
  const actual = jest.requireActual('./styles');
  return { ...actual, IS_SAFARI_26: true };
});

const createBasicDataFrame = (): DataFrame =>
  applyFieldOverrides({
    data: [
      toDataFrame({
        name: 'TestData',
        length: 1,
        fields: [{ name: 'Column A', type: FieldType.string, values: ['A1'], config: { custom: {} } }],
      }),
    ],
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme: createTheme(),
  })[0];

describe('TableNG Safari 26 workaround', () => {
  it('wraps the table in a contain:strict container without breaking rendering', () => {
    const { container } = render(
      <TableNG enableVirtualization={false} data={createBasicDataFrame()} width={800} height={600} />
    );

    // The grid renders inside an extra wrapper div rather than at the container root.
    const grid = container.querySelector('[role="grid"]');
    expect(grid).toBeInTheDocument();
    expect(container.firstElementChild).not.toBe(grid);
    expect(container.firstElementChild?.tagName).toBe('DIV');

    // cell content still renders through the wrapper
    expect(screen.getByText('A1')).toBeInTheDocument();
  });
});
