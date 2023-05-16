import http from "k6/http";
import { check } from "k6";
import { url } from "./env.js";

export const annotations = {
  /**
   * Creates an annotation associated with a dashboard.
   *
   * @param {string} dashboardUID The UID of the dashboard for which the annotation should be created.
   * @param {string[]} tags A list of tags that can be used to filter annotations.
   * @param {string} text The text that a user would see when looking at the annotation.
   */
  createInDashboard: (dashboardUID, tags, text) => {
    const res = http.post(
      url + "/api/annotations",
      JSON.stringify(
        annotationJSON(dashboardUID, tags, text)
      ),
      {
        tags: { type: "annotations", operation: "create" },
        headers: { "Content-Type": "application/json" },
      }
    );
    check(res, {
      "create annotation status is 200": (r) => r.status === 200,
    });
    return res.json("id");
  },
  /**
   * Deletes an annotation based on the provided identifier.
   *
   * @param {string} id Unique identifier for the annotation that is to be deleted.
   */
  del: (id) => {
    const res = http.del(
      http.url`${url}/api/annotations/${id}`,
      null,
      {
        tags: { type: "annotations", operation: "delete" },
      }
    );

    check(res, {
      "delete annotation status is status 200": (r) => r.status === 200,
    });
  },
};

// Helper function to create an annotation.
function annotationJSON(dashboardUID, tags, text) {
  return {
    dashboardUID: dashboardUID,
    tags: tags,
    text: text,
  };
}
