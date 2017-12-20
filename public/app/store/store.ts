import { types } from "mobx-state-tree";

const Search = types
  .model({
    name: "asdas",
    done: false
  })
  .actions(self => ({
    search() {
      self.name = "changed";
    }
  }));

const RootStore = types.model({
  search: types.optional(Search, {})
});

const store = RootStore.create({});

export { store };
