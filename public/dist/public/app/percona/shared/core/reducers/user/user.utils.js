export const toUserDetailsModel = (res) => ({
    userId: res.user_id,
    productTourCompleted: !!res.product_tour_completed,
    alertingTourCompleted: !!res.alerting_tour_completed,
});
//# sourceMappingURL=user.utils.js.map