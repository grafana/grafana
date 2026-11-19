import { filterTemplates, getTemplateSortOptions } from './templateFilters';

const templates = [
  { title: 'Node exporter', description: 'Host metrics' },
  { title: 'apache', description: 'Web server traffic' },
  { title: 'Kubernetes cluster', description: 'Nodes and pods' },
];
const getTitle = (template: { title: string }) => template.title;
const getDescription = (template: { description: string }) => template.description;

describe('filterTemplates', () => {
  it('keeps every template, in its order, without a search or sort', () => {
    expect(filterTemplates(templates, getTitle, getDescription)).toEqual(templates);
  });

  it('matches the title or the description, ignoring case', () => {
    expect(filterTemplates(templates, getTitle, getDescription, ' NODE ').map(getTitle)).toEqual([
      'Node exporter',
      'Kubernetes cluster',
    ]);
  });

  it('sorts by title either way, ignoring case', () => {
    expect(filterTemplates(templates, getTitle, getDescription, '', 'asc').map(getTitle)).toEqual([
      'apache',
      'Kubernetes cluster',
      'Node exporter',
    ]);
    expect(filterTemplates(templates, getTitle, getDescription, '', 'desc').map(getTitle)).toEqual([
      'Node exporter',
      'Kubernetes cluster',
      'apache',
    ]);
  });
});

describe('getTemplateSortOptions', () => {
  it('offers the template modal sort orders', async () => {
    expect(await getTemplateSortOptions()).toEqual([
      { value: 'asc', label: 'Alphabetically (A–Z)' },
      { value: 'desc', label: 'Alphabetically (Z–A)' },
    ]);
  });
});
