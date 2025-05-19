import { getTemplateSrv } from '@grafana/runtime';

// Mock the config module to avoid undefined panels error
jest.mock('app/core/config', () => ({
  config: {
    panels: {
      debug: {
        state: 'alpha',
      },
    },
  },
}));

// Mock the dimensions module since it's imported by utils.ts
jest.mock('app/features/dimensions', () => ({
  getColorDimension: jest.fn(),
  getScalarDimension: jest.fn(),
  getScaledDimension: jest.fn(),
  getTextDimension: jest.fn(),
}));

// Mock the grafana datasource since it's imported by utils.ts
jest.mock('app/plugins/datasource/grafana/datasource', () => ({
  getGrafanaDatasource: jest.fn(),
}));

// Mock the template service
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(),
}));

import { hasVariableDependencies } from './utils';

describe('hasVariableDependencies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when object contains existing template variables', () => {
    const availableVariables = [{ name: 'variable' }];
    const mockTemplateSrv = {
      containsTemplate: jest.fn().mockImplementation((str) => {
        // Check if any of the available variables are in the string
        return availableVariables.some((v) => str.includes(`$${v.name}`));
      }),
      getVariables: jest.fn().mockReturnValue(availableVariables),
    };
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);

    const obj = { key: '$variable' };
    expect(hasVariableDependencies(obj)).toBe(true);
    expect(mockTemplateSrv.containsTemplate).toHaveBeenCalledWith(JSON.stringify(obj));
  });

  it('should return false when object contains non-existent template variables', () => {
    const availableVariables = [{ name: 'variable' }];
    const mockTemplateSrv = {
      containsTemplate: jest.fn().mockImplementation((str) => {
        return availableVariables.some((v) => str.includes(`$${v.name}`));
      }),
      getVariables: jest.fn().mockReturnValue(availableVariables),
    };
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);

    const obj = { key: '$nonexistent' };
    expect(hasVariableDependencies(obj)).toBe(false);
    expect(mockTemplateSrv.containsTemplate).toHaveBeenCalledWith(JSON.stringify(obj));
  });

  it('should return false when object does not contain template variables', () => {
    const mockTemplateSrv = {
      containsTemplate: jest.fn().mockReturnValue(false),
      getVariables: jest.fn().mockReturnValue([]),
    };
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);

    const obj = { key: 'static value' };
    expect(hasVariableDependencies(obj)).toBe(false);
    expect(mockTemplateSrv.containsTemplate).toHaveBeenCalledWith(JSON.stringify(obj));
  });

  it('should handle nested objects with existing template variables', () => {
    const availableVariables = [{ name: 'variable' }];
    const mockTemplateSrv = {
      containsTemplate: jest.fn().mockImplementation((str) => {
        return availableVariables.some((v) => str.includes(`$${v.name}`));
      }),
      getVariables: jest.fn().mockReturnValue(availableVariables),
    };
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);

    const obj = {
      key: 'static value',
      nested: {
        anotherKey: '$variable',
      },
    };
    expect(hasVariableDependencies(obj)).toBe(true);
    expect(mockTemplateSrv.containsTemplate).toHaveBeenCalledWith(JSON.stringify(obj));
  });
});
