import { types } from "mobx-state-tree";

const Search = types.model({
  name: "",
  done: false
});

const RootStore = types.model({
  search: types.map(Search)
});

const store = RootStore.create({
  search: {}
});

export { store };
