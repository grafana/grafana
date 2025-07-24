import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LanguageProvider } from '@grafana/data';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { initTemplateSrv } from '../test/test_utils';
import { keywordOperators, numberOperators, operators, stringOperators } from '../traceql/traceql';

import SearchField from './SearchField';

describe('SearchField', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    const expectedValues = {
      interpolationVar: 'interpolationText',
      interpolationText: 'interpolationText',
      interpolationVarWithPipe: 'interpolationTextOne|interpolationTextTwo',
      scopedInterpolationText: 'scopedInterpolationText',
    };
    initTemplateSrv([{ name: 'templateVariable1' }, { name: 'templateVariable2' }], expectedValues);

    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not render tag if hideTag is true', async () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = { id: 'test1', valueType: 'string', tag: 'test-tag' };

    const { container } = renderSearchField(updateFilter, filter, [], true);

    await waitFor(async () => {
      expect(container.querySelector(`input[aria-label="select test1 tag"]`)).not.toBeInTheDocument();
      expect(container.querySelector(`input[aria-label="select test1 operator"]`)).toBeInTheDocument();
      expect(container.querySelector(`input[aria-label="select test1 value"]`)).toBeInTheDocument();
    });
  });

  it('should update operator when new value is selected in operator input', async () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = { id: 'test1', operator: '=', valueType: 'string', tag: 'test-tag' };
    const { container } = renderSearchField(updateFilter, filter);

    const select = container.querySelector(`input[aria-label="select test1 operator"]`);
    expect(select).not.toBeNull();
    expect(select).toBeInTheDocument();
    if (select) {
      await user.click(select);
      jest.advanceTimersByTime(1000);
      const largerThanOp = await screen.findByText('!=');
      await user.click(largerThanOp);

      expect(updateFilter).toHaveBeenCalledWith({ ...filter, operator: '!=' });
    }
  });

  it('should update value when new value is selected in value input', async () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = {
      id: 'test1',
      isCustomValue: false,
      valueType: 'string',
      tag: 'test-tag',
    };
    const { container } = renderSearchField(updateFilter, filter);

    const select = container.querySelector(`input[aria-label="select test1 value"]`);
    expect(select).not.toBeNull();
    expect(select).toBeInTheDocument();
    if (select) {
      // Add first value
      await user.click(select);
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      const driverVal = await screen.findByText('driver');

      await act(async () => {
        await user.click(driverVal);
      });
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, value: ['driver'] });

      // Add a second value
      await user.click(select);

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      const customerVal = await screen.findByText('customer');

      await user.click(customerVal);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, value: ['driver', 'customer'] });

      // Remove the first value
      const firstValRemove = await screen.findAllByLabelText('Remove');

      await user.click(firstValRemove[0]);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, value: ['customer'] });
    }
  });

  it('should update tag when new value is selected in tag input', async () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = {
      id: 'test1',
      valueType: 'string',
    };
    const { container } = renderSearchField(updateFilter, filter, ['tag1', 'tag22', 'tag33']);

    const select = container.querySelector(`input[aria-label="select test1 tag"]`);
    expect(select).not.toBeNull();
    expect(select).toBeInTheDocument();
    if (select) {
      // Select tag22 as the tag
      await user.click(select);
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      const tag22 = await screen.findByText('tag22');
      await user.click(tag22);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, tag: 'tag22', value: [] });

      // Select tag1 as the tag
      await user.click(select);
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      const tag1 = await screen.findByText('tag1');
      await user.click(tag1);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, tag: 'tag1', value: [] });

      // Remove the tag
      const tagRemove = await screen.findByLabelText('Clear value');
      await user.click(tagRemove);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, value: [] });
    }
  });

  it('should provide intrinsic as a selectable scope', async () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = { id: 'test1', valueType: 'string', tag: 'test-tag' };

    const { container } = renderSearchField(updateFilter, filter, [], true);

    const scopeSelect = container.querySelector(`input[aria-label="select test1 scope"]`);
    expect(scopeSelect).not.toBeNull();
    expect(scopeSelect).toBeInTheDocument();

    if (scopeSelect) {
      await user.click(scopeSelect);
      jest.advanceTimersByTime(1000);
      expect(await screen.findByText('resource')).toBeInTheDocument();
      expect(await screen.findByText('span')).toBeInTheDocument();
      expect(await screen.findByText('unscoped')).toBeInTheDocument();
      expect(await screen.findByText('intrinsic')).toBeInTheDocument();
      expect(await screen.findByText('$templateVariable1')).toBeInTheDocument();
      expect(await screen.findByText('$templateVariable2')).toBeInTheDocument();
    }
  });

  it('should only show keyword operators if options tag type is keyword', async () => {
    const filter: TraceqlFilter = { id: 'test1', operator: '=', valueType: 'string', tag: 'test-tag' };
    const lp = {
      getOptionsV2: jest.fn().mockReturnValue([
        {
          value: 'ok',
          label: 'ok',
          type: 'keyword',
        },
      ]),
      getIntrinsics: jest.fn().mockReturnValue(['duration']),
      getTags: jest.fn().mockReturnValue(['cluster']),
    } as unknown as TempoLanguageProvider;

    const { container } = renderSearchField(jest.fn(), filter, [], false, lp);
    const select = container.querySelector(`input[aria-label="select test1 operator"]`);
    if (select) {
      await user.click(select);
      await waitFor(async () => {
        expect(screen.getByText('Equals')).toBeInTheDocument();
        expect(screen.getByText('Not equals')).toBeInTheDocument();
        operators
          .filter((op) => !keywordOperators.includes(op))
          .forEach((op) => {
            expect(screen.queryByText(op)).not.toBeInTheDocument();
          });
      });
    }
  });

  it('should only show string operators if options tag type is string', async () => {
    const filter: TraceqlFilter = { id: 'test1', operator: '=', valueType: 'string', tag: 'test-tag' };
    const { container } = renderSearchField(jest.fn(), filter);
    const select = container.querySelector(`input[aria-label="select test1 operator"]`);
    if (select) {
      await user.click(select);
      await waitFor(async () => {
        expect(screen.getByText('Equals')).toBeInTheDocument();
        expect(screen.getByText('Not equals')).toBeInTheDocument();
        expect(screen.getByText('Matches regex')).toBeInTheDocument();
        expect(screen.getByText('Does not match regex')).toBeInTheDocument();
        operators
          .filter((op) => !stringOperators.includes(op))
          .forEach((op) => {
            expect(screen.queryByText(op)).not.toBeInTheDocument();
          });
      });
    }
  });

  it('should only show number operators if options tag type is number', async () => {
    const filter: TraceqlFilter = { id: 'test1', operator: '=', valueType: 'string', tag: 'test-tag' };
    const lp = {
      getOptionsV2: jest.fn().mockReturnValue([
        {
          value: 200,
          label: 200,
          type: 'int',
        },
      ]),
      getIntrinsics: jest.fn().mockReturnValue(['duration']),
      getTags: jest.fn().mockReturnValue(['cluster']),
    } as unknown as TempoLanguageProvider;

    const { container } = renderSearchField(jest.fn(), filter, [], false, lp);
    const select = container.querySelector(`input[aria-label="select test1 operator"]`);
    if (select) {
      await user.click(select);
      await waitFor(async () => {
        expect(screen.getByText('Equals')).toBeInTheDocument();
        expect(screen.getByText('Not equals')).toBeInTheDocument();
        expect(screen.getByText('Greater')).toBeInTheDocument();
        expect(screen.getByText('Less')).toBeInTheDocument();
        expect(screen.getByText('Greater or Equal')).toBeInTheDocument();
        expect(screen.getByText('Less or Equal')).toBeInTheDocument();
        operators
          .filter((op) => !numberOperators.includes(op))
          .forEach((op) => {
            expect(screen.queryByText(op)).not.toBeInTheDocument();
          });
      });
    }
  });

  it('should create custom option with single value when filter value is not an array', async () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = {
      id: 'test1',
      valueType: 'string',
      tag: 'test-tag',
      value: 'existing-value',
    };

    const { container } = renderSearchField(updateFilter, filter, [], false, undefined, false);

    const select = container.querySelector(`input[aria-label="select test1 value"]`);
    expect(select).not.toBeNull();
    expect(select).toBeInTheDocument();

    if (select) {
      await user.type(select, 'custom-value');
      await user.keyboard('{Enter}');

      expect(updateFilter).toHaveBeenCalledWith({
        ...filter,
        value: 'custom-value',
        valueType: 'string',
        isCustomValue: true,
      });
    }
  });

  it('should create custom option with array value when filter value is an array', async () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = {
      id: 'test1',
      valueType: 'string',
      tag: 'test-tag',
      value: ['existing-value1', 'existing-value2'],
    };

    const { container } = renderSearchField(updateFilter, filter, [], false, undefined, true);

    const select = container.querySelector(`input[aria-label="select test1 value"]`);
    expect(select).not.toBeNull();
    expect(select).toBeInTheDocument();

    if (select) {
      await user.type(select, 'custom-value');
      await user.keyboard('{Enter}');

      expect(updateFilter).toHaveBeenCalledWith({
        ...filter,
        value: ['existing-value1', 'existing-value2', 'custom-value'],
        valueType: 'string',
        isCustomValue: true,
      });
    }
  });
});

const renderSearchField = (
  updateFilter: (f: TraceqlFilter) => void,
  filter: TraceqlFilter,
  tags?: string[],
  hideTag?: boolean,
  lp?: LanguageProvider,
  isMulti?: boolean
) => {
  const languageProvider =
    lp ||
    ({
      getOptionsV2: jest.fn().mockReturnValue([
        {
          value: 'customer',
          label: 'customer',
          type: 'string',
        },
        {
          value: 'driver',
          label: 'driver',
          type: 'string',
        },
      ]),
      getIntrinsics: jest.fn().mockReturnValue(['duration']),
      getTags: jest.fn().mockReturnValue(['cluster']),
    } as unknown as TempoLanguageProvider);

  const datasource: TempoDatasource = {
    search: {
      filters: [
        {
          id: 'service-name',
          tag: 'service.name',
          operator: '=',
          scope: TraceqlSearchScope.Resource,
        },
        { id: 'span-name', type: 'static', tag: 'name', operator: '=', scope: TraceqlSearchScope.Span },
      ],
    },
    languageProvider,
  } as TempoDatasource;

  return render(
    <SearchField
      datasource={datasource}
      updateFilter={updateFilter}
      filter={filter}
      setError={() => {}}
      tags={tags || []}
      hideTag={hideTag}
      query={'{}'}
      addVariablesToOptions={true}
      isMulti={isMulti}
    />
  );
};
