# Runtime stage - just a simple nginx to serve static files
FROM nginx:alpine

# Delete the default nginx content
RUN rm -rf /usr/share/nginx/html
RUN mkdir -p /usr/share/nginx/html/public

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
EXPOSE 81
