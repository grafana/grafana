import { ComboboxOption } from './types';

let fakeApiOptions: Array<ComboboxOption<string>>;
export async function fakeSearchAPI(urlString: string): Promise<Array<ComboboxOption<string>>> {
  const searchParams = new URL(urlString).searchParams;

  const errorOnQuery = searchParams.get('errorOnQuery')?.toLowerCase();
  const searchQuery = searchParams.get('query')?.toLowerCase();

  if (errorOnQuery === searchQuery) {
    throw new Error('An error occurred (because it was asked for)');
  }

  if (!fakeApiOptions) {
    fakeApiOptions = await generateOptions(1000);
    console.log('fakeApiOptions', fakeApiOptions);
  }

  if (!searchQuery || searchQuery.length === 0) {
    return Promise.resolve(fakeApiOptions.slice(0, 24));
  }

  const filteredOptions = Promise.resolve(
    fakeApiOptions.filter((opt) => opt.label?.toLowerCase().includes(searchQuery))
  );

  const delay = searchQuery.length % 2 === 0 ? 200 : 1000;

  return new Promise<Array<ComboboxOption<string>>>((resolve) => {
    setTimeout(() => resolve(filteredOptions), delay);
  });
}

export async function generateOptions(amount: number): Promise<ComboboxOption[]> {
  return Array.from({ length: amount }, (_, index) => ({
    label: 'Option ' + index,
    value: index.toString(),
  }));
}

export async function generateGroupingOptions(amount: number): Promise<ComboboxOption[]> {
  return Array.from({ length: amount }, (_, index) => ({
    label: 'Option ' + index,
    value: index.toString(),
    group: index % 19 !== 0 ? 'Group ' + Math.floor(index / 20) : undefined,
  }));
}
