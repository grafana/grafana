/**
 * Rows per request, not the size of the list: pages are followed until the server runs out or the
 * accumulation ceiling is reached, so this only decides how many round trips that takes.
 *
 * The endpoint's own maximum, because the pages come back sequentially - each one needs the previous
 * cursor - so a smaller page multiplies latency rather than spreading it. The projection makes the
 * size side cheap either way, at roughly 280 bytes a row. Asking for more is pointless: the server
 * clamps to this.
 *
 * Its own module so that reading it does not mean importing the list, which injects RTK endpoints as
 * it loads. The document header wants the number and nothing else, and importing the list for it put
 * the list page's search API into the module graph of every notebook scene.
 */
export const NOTEBOOKS_PAGE_LIMIT = 500;
