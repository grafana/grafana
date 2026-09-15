import { SelectionSearchInput } from '../SelectionSearchInput';

const Search = ({ searchFn, searchPhrase }: { searchPhrase: string; searchFn: (searchPhrase: string) => void }) => {
  return (
    <SelectionSearchInput
      ariaLabel="data source search"
      placeholder="search by data source name or type"
      searchFn={searchFn}
      searchPhrase={searchPhrase}
    />
  );
};

export default Search;
