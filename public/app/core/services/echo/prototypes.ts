import { event } from "jquery";

function reportInteraction(eventName: string, properties: object) {
  // ...
}

// +------------------------------------------------------------+ //
// |                       First proposal                       | //
// +------------------------------------------------------------+ //

//
// @file: features/navigation/events.ts
interface MegaMenuItemClickedProps {
  /** This is foo */
  pathCheck: boolean;

  /** Whether menu is docked or not */
  menuIsDocked: boolean;

  /** Whether the clicked item is bookmarked */
  itemIsBookmarked: boolean;

  /** Whether the bookmark toggle is on */
  bookmarkToggleOn: boolean;
}

const navigationEvents = createTracking({
  /** User clicked on a navigation item */
  megaMenuItemClick: (properties: MegaMenuItemClickedProps) => {
      return {
          eventName: "megaMenuItemClicked",
          properties
      }
  }
});

//
// @file: features/navigation/MegaMenu.tsx
navigationEvents.megaMenuItemClick({...})



// +------------------------------------------------------------+ //
// |                       Second proposal                      | //
// +------------------------------------------------------------+ //

//
// @file: features/navigation/events.ts

/**
* User clicked on a navigation item
* @owner grafana frontend squad
*/
interface ItemClickProperties {
  /** The path of the clicked item */
  path: string;

  /** The state of the navigation menu */
  menuIsDocked: boolean;

  /** Whether the clicked item is bookmarked */
  itemIsBookmarked: boolean;

  /** Whether the bookmark toggle is on */
  bookmarkToggleOn: boolean;
}


const navEventClient = createTracking("grafana", "navigation")
  .addEvent<ItemClickProperties>('item_clicked')
  .addEvent("item_clicked", (props: ItemClickProperties) => props)
  .addEvent({
    eventName: "item_click",
  })
.finish();

//
// @file: features/navigation/MegaMenu.tsx
navEventClient.megaMenuItemClick(...)



// +------------------------------------------------------------+ //
// |                       Third proposal                       | //
// +------------------------------------------------------------+ //

//
// @file: core/echo.ts
type EventFunction<P extends object> = (props: P) => void;
type EventFunctionFactory<P extends object> = (eventName: string) => EventFunction<P>;

// doesn't have correct types yet
function createEventFactory<P extends object>(product: string, featureName: string): EventFunctionFactory<P> {
  return (eventName: string) => (props: P) => reportInteraction(`${product}_${featureName}_${eventName}`, props)
}

function createTrackingEvent<P extends object>(product: string, eventName: string): EventFunction<P> {
  return (props: P) => reportInteraction(product + eventName, props)
}

//
// @file: features/navigation/events.ts
interface ItemClickProperties {
  /** The path of the clicked item */
  path: string;

  /** The state of the navigation menu */
  menuIsDocked: boolean;

  /** Whether the clicked item is bookmarked */
  itemIsBookmarked: boolean;

  /** Whether the bookmark toggle is on */
  bookmarkToggleOn: boolean;
}

const createNavEvent = createEventFactory("grafana", "navigation")

/**
* User clicked on a navigation item
* @owner Grafana frontend squad
* */
export const trackItemClck = createNavEvent<ItemClickProperties>("item_click");
