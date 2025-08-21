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
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Min',
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'ASDSADASDSADA',
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
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'DescriptionMatch',
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Frame',
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
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Min',
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Max',
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
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Threshold',
          render: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Max',
          render: jest.fn(),
        })
      ),
  ];
}
