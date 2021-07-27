// /**
//  * Make sure everything has a unique ID
//  *
//  * returns true if the scene was mutated!
//  */
//  export function validateScene(root: LayerConfig): boolean {
//     const ids = new Set<string>();
//     root.type = 'layer'; // make sure!
//     const changed = validateItem(root, ids);
//     delete (root as any).anchor;
//     delete (root as any).placement;
//     return changed;
//   }

//   function validateItem(item: ItemConfig, ids: Set<string>): boolean {
//     let changed = false;
//     while (!item.id || ids.has(item.id)) {
//       item.id = generateID();
//       changed = true;
//     }
//     ids.add(item.id);

//     if (isLayerConfig(item)) {
//       if (!item.items) {
//         item.items = [];
//         changed = true;
//       }
//       for (const child of item.items) {
//         if (validateItem(child, ids)) {
//           changed = true;
//         }
//       }
//     }
//     return changed;
//   }

//   // randomish ID
//   export function generateID() {
//     var firstPart = (Math.random() * 46656) | 0;
//     var secondPart = (Math.random() * 46656) | 0;
//     return ('000' + firstPart.toString(36)).slice(-3) + ('000' + secondPart.toString(36)).slice(-3);
//   }

//   /**
//    * Make a copy that is shifted by some amount
//    */
//   export function duplicateItem(item: ItemConfig): ItemConfig {
//     const copy = cloneDeep(item);
//     copy.id = generateID();

//     // Shift (without chaning width)
//     const { anchor } = copy;
//     if (anchor.right) {
//       copy.placement.right! += 20;
//       if (anchor.left) {
//         copy.placement.left! += 20;
//       }
//     } else {
//       copy.placement.left! += 20;
//     }

//     if (anchor.bottom) {
//       copy.placement.bottom! += 10;
//       if (anchor.top) {
//         copy.placement.top! += 10;
//       }
//     } else {
//       copy.placement.top! += 10;
//     }
//     return copy;
//   }
