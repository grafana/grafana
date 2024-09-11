export const components = {
  Menu: {
    MenuComponent: {
      '9.0.0': (title: string) => `${title} menu`,
    },
    MenuGroup: {
      '8.5.0': (title: string) => `${title} menu group`,
    },
    MenuItem: { '8.5.0': ({ title }: { title: string }) => `${title} menu item` },
    SubMenu: {
      container: {
        '10.3.0': 'data-testid SubMenu container',
        '8.5.0': 'SubMenu',
      },
      icon: {
        '10.3.0': 'data-testid SubMenu icon',
        '8.5.0': 'SubMenu icon',
      },
    },
  },
};

// const expected = {
//   Menu: {
//     MenuComponent: (title: string) => `${title} menu`,
//     MenuGroup: (title: string) => `${title} menu group`,
//     MenuItem: (title: string) => `${title} menu item`,
//     SubMenu: {
//       container: 'data-testid SubMenu container',
//       icon: 'data-testid SubMenu icon',
//     },
//   },
// };
