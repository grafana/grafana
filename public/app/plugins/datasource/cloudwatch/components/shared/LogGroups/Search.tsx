import { SelectionSearchInput } from '../SelectionSearchInput';

// TODO: consider moving search into grafana/ui, this is mostly the same as that in azure monitor
const Search = ({ searchFn, searchPhrase }: { searchPhrase: string; searchFn: (searchPhrase: string) => void }) => {
  return (
    <SelectionSearchInput
      ariaLabel="log group search"
      placeholder="search by log group name prefix"
      searchFn={searchFn}
      searchPhrase={searchPhrase}
    />
  );
};

export default Search;
