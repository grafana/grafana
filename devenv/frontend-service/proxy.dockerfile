# Runtime stage - just a simple nginx to serve static files
# We bake the config into the image so we can live-update it with Tilt when it changes
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
