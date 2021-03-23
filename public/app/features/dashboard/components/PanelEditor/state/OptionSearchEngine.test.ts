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
          description: 'AAA',
          Component: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Min',
          description: 'BBB',
          Component: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'ASDSADASDSADA',
          description: 'DescriptionMatch',
          Component: jest.fn(),
        })
      ),
    new OptionsPaneCategoryDescriptor({
      id: 'Axis',
      title: 'Axis',
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Min',
          description: 'CCC',
          Component: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'DescriptionMatch',
          description: 'MUUUU',
          Component: jest.fn(),
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Frame',
          description: 'MUUUU',
          Component: jest.fn(),
        })
      ),
  ];
}
