# Runtime stage - just a simple nginx to serve static files
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
EXPOSE 81
