import { v4 as uuiv4 } from 'uuid';

import { OptionsPaneCategoryDescriptor } from '../OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from '../OptionsPaneItemDescriptor';

import { OptionSearchEngine } from './OptionSearchEngine';

describe('OptionSearchEngine', () => {
  it('Can search options based on title', () => {
    const engine = new OptionSearchEngine(getOptionCategories(), []);
    const results = engine.search('Min');
    expect(results.optionHits.length).toBe(2);
    expect(results.optionHits[0].props.title).toBe('Min');
  });

  it('When matching both title and description title should rank higher', () => {
    const engine = new OptionSearchEngine(getOptionCategories(), []);
    const results = engine.search('DescriptionMatch');
    expect(results.optionHits.length).toBe(2);
    expect(results.optionHits[0].props.title).toBe('DescriptionMatch');
  });

  it('When matching both category and title category title should rank higher', () => {
    const engine = new OptionSearchEngine(getOptionCategories(), []);
    const results = engine.search('frame');
    expect(results.optionHits.length).toBe(4);
    expect(results.optionHits[0].props.title).toBe('Frame');
  });

  it('Override hits should contain matcher and matched properties', () => {
    const engine = new OptionSearchEngine(getOptionCategories(), getOverrides());
    const results = engine.search('Max');
    expect(results.overrideHits.length).toBe(2);
    expect(results.overrideHits[0].items.length).toBe(2);
    expect(results.overrideHits[0].items[0].props.title).toBe('Match by name');
    expect(results.overrideHits[0].items[1].props.title).toBe('Max');
  });

  it('Override hits should not add matcher twice', () => {
    const engine = new OptionSearchEngine(getOptionCategories(), getOverrides());
    const results = engine.search('Match by name');
    expect(results.overrideHits.length).toBe(2);
    expect(results.overrideHits[0].items.length).toBe(1);
  });

  describe('Value search', () => {
    it('Can search options based on string value', () => {
      const engine = new OptionSearchEngine(getOptionCategoriesWithValues(), []);
      const results = engine.search('horizontal');
      expect(results.optionHits.length).toBe(1);
      expect(results.optionHits[0].props.title).toBe('Direction');
    });

    it('Can search options based on numeric value', () => {
      const engine = new OptionSearchEngine(getOptionCategoriesWithValues(), []);
      const results = engine.search('42');
      expect(results.optionHits.length).toBe(1);
      expect(results.optionHits[0].props.title).toBe('Max value');
    });

    it('Can search options based on boolean value', () => {
      const engine = new OptionSearchEngine(getOptionCategoriesWithValues(), []);
      const results = engine.search('true');
      expect(results.optionHits.length).toBe(1);
      expect(results.optionHits[0].props.title).toBe('Show legend');
    });

    it('Can search options based on nested object properties', () => {
      const engine = new OptionSearchEngine(getOptionCategoriesWithValues(), []);
      const results = engine.search('DURATION');
      expect(results.optionHits.length).toBe(1);
      expect(results.optionHits[0].props.title).toBe('Y-Axis');
    });

    it('Value matches should rank lower than description matches', () => {
      const engine = new OptionSearchEngine(getOptionCategoriesWithValues(), []);
      const results = engine.search('SearchTerm');
      expect(results.optionHits.length).toBe(3);
      // Title match should be first (rank 1)
      expect(results.optionHits[0].props.title).toBe('SearchTerm');
      // Description match should be second (rank 2)
      expect(results.optionHits[1].props.title).toBe('Option with description match');
      // Value match should be third (rank 3)
      expect(results.optionHits[2].props.title).toBe('Option with value match');
    });

    it('Should handle null and undefined values gracefully', () => {
      const categories = [
        new OptionsPaneCategoryDescriptor({
          id: 'Test',
          title: 'Test',
        })
          .addItem(
            new OptionsPaneItemDescriptor({
              title: 'Null value',
              id: uuiv4(),
              value: null,
              render: jest.fn(),
            })
          )
          .addItem(
            new OptionsPaneItemDescriptor({
              title: 'Undefined value',
              id: uuiv4(),
              value: undefined,
              render: jest.fn(),
            })
          )
          .addItem(
            new OptionsPaneItemDescriptor({
              title: 'No value property',
              id: uuiv4(),
              render: jest.fn(),
            })
          ),
      ];

      const engine = new OptionSearchEngine(categories, []);
      // Should not crash and should not match null/undefined values
      const results = engine.search('null');
      expect(results.optionHits.length).toBe(1);
      expect(results.optionHits[0].props.title).toBe('Null value');
    });
  });
});

function getOptionCategories(): OptionsPaneCategoryDescriptor[] {
  return [
    new OptionsPaneCategoryDescriptor({
      id: 'Panel frame',
      title: 'Panel frame',
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Title',
          id: uuiv4(),
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Min',
          id: uuiv4(),
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'ASDSADASDSADA',
          id: uuiv4(),
          description: 'DescriptionMatch',
          render: jest.fn(),
        })
      ),
    new OptionsPaneCategoryDescriptor({
      id: 'Axis',
      title: 'Axis',
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Min',
          id: uuiv4(),
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'DescriptionMatch',
          id: uuiv4(),
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Frame',
          id: uuiv4(),
          render: jest.fn(),
        })
      ),
  ];
}

function getOverrides(): OptionsPaneCategoryDescriptor[] {
  return [
    new OptionsPaneCategoryDescriptor({
      id: 'Override 1',
      title: 'Override 1',
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Match by name',
          id: uuiv4(),
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Min',
          id: uuiv4(),
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Max',
          id: uuiv4(),
          render: jest.fn(),
        })
      ),
    new OptionsPaneCategoryDescriptor({
      id: 'Override 2',
      title: 'Override 2',
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Match by name',
          id: uuiv4(),
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Threshold',
          id: uuiv4(),
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Max',
          id: uuiv4(),
          render: jest.fn(),
        })
      ),
  ];
}

function getOptionCategoriesWithValues(): OptionsPaneCategoryDescriptor[] {
  return [
    new OptionsPaneCategoryDescriptor({
      id: 'Layout',
      title: 'Layout',
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Direction',
          id: uuiv4(),
          value: 'horizontal',
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Max value',
          id: uuiv4(),
          value: 42,
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Show legend',
          id: uuiv4(),
          value: true,
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Y-Axis',
          id: uuiv4(),
          value: {
            axisPlacement: 'left',
            reverse: false,
            axisLabel: 'axis_label (latency, unit: DURATION)',
            unit: 's',
          },
          render: jest.fn(),
        })
      ),
    new OptionsPaneCategoryDescriptor({
      id: 'Ranking Test',
      title: 'Ranking Test',
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'SearchTerm',
          id: uuiv4(),
          value: 'something else',
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Option with value match',
          id: uuiv4(),
          value: 'SearchTerm',
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Option with description match',
          id: uuiv4(),
          description: 'SearchTerm',
          render: jest.fn(),
        })
      ),
  ];
}
