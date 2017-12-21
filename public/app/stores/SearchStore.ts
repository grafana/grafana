import { types } from "mobx-state-tree";

export const ResultItem = types.model("ResultItem", {
  id: types.identifier(types.number),
  folderId: types.optional(types.number, 0),
  title: types.string,
  url: types.string,
  icon: types.string,
  folderTitle: types.optional(types.string, "")
});

export const SearchResultSection = types
  .model("SearchResultSection", {
    id: types.identifier(),
    title: types.string,
    icon: types.string,
    expanded: types.boolean,
    items: types.array(ResultItem)
  })
  .actions(self => ({
    toggle() {
      self.expanded = !self.expanded;

      for (let i = 0; i < 100; i++) {
        self.items.push(
          ResultItem.create({
            id: i,
            title: "Dashboard " + self.items.length,
            icon: "gicon gicon-dashboard",
            url: "asd"
          })
        );
      }
    }
  }));

export const SearchStore = types
  .model("SearchStore", {
    sections: types.array(SearchResultSection)
  })
  .actions(self => ({
    query() {
      for (let i = 0; i < 100; i++) {
        self.sections.push(
          SearchResultSection.create({
            id: "starred" + i,
            title: "starred",
            icon: "fa fa-fw fa-star-o",
            expanded: false,
            items: []
          })
        );
      }
    }
  }));
